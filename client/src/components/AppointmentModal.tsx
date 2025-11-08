import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { X, Search, Trash2, Edit3, Save, MessageSquare } from "lucide-react";

export function AppointmentModal({ event, onClose, onSave, client }: any) {
  const isEdit = !!event?.id;
  const fromClient = !!client;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     FORM STATE
  ========================================================= */
  const [form, setForm] = useState({
    id: event?.id || null,
    title: event?.title || "",
    address: client?.address || event?.address || "",
    advisor: event?.advisor || "",
    date_time:
      event?.date_time instanceof Date
        ? event.date_time.toISOString().slice(0, 16)
        : typeof event?.date_time === "string"
        ? event.date_time.slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    status: event?.status || "pending",
    note: event?.note || "",
    client_id: client?.id || event?.client_id || "",
  });

  /* =========================================================
     CLIENT SEARCH
  ========================================================= */
  const [clients, setClients] = useState<
    { id: number; fullname: string; address?: string }[]
  >([]);
  const [search, setSearch] = useState(client?.fullname || "");
  const [filtered, setFiltered] = useState<typeof clients>([]);

  useEffect(() => {
    if (fromClient) return;
    (async () => {
      try {
        const data = await apiGet("/clientes");
        setClients(data);
        setFiltered(data);

        if (event?.client_id) {
          const c = data.find((x) => x.id === event.client_id);
          if (c) {
            setSearch(c.fullname);
            setForm((prev) => ({
              ...prev,
              address: c.address || prev.address,
            }));
          }
        }
      } catch {
        toast.error("Error loading clients");
      }
    })();
  }, [event?.client_id, fromClient]);

  useEffect(() => {
    if (!search.trim()) setFiltered(clients);
    else {
      const q = search.toLowerCase();
      setFiltered(clients.filter((c) => c.fullname.toLowerCase().includes(q)));
    }
  }, [search, clients]);

  const handleClientSelect = (client: any) => {
    setForm((prev) => ({
      ...prev,
      client_id: client.id,
      address: client.address || "",
    }));
    setSearch(client.fullname);
    setDropdownOpen(false);
  };

  /* =========================================================
     NOTES HANDLING (GET / ADD / EDIT / DELETE)
  ========================================================= */
  const [notes, setNotes] = useState<
    { id: number; nota: string; fecha: string; author_name?: string }[]
  >([]);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editedNoteText, setEditedNoteText] = useState("");

  const fetchNotes = async (appointmentId: number) => {
    try {
      const data = await apiGet(`/appointments/${appointmentId}`);
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
    }
  };

  useEffect(() => {
    if (form.id) fetchNotes(form.id);
  }, [form.id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !form.id) return;
    try {
      const res = await apiPost(`/appointments/${form.id}/notes`, {
        nota: newNote.trim(),
      });
      setNotes((prev) => [...prev, res]);
      setNewNote("");
      toast.success("Note added ✅");
    } catch {
      toast.error("Error adding note");
    }
  };

  const handleEditNote = (noteId: number, currentText: string) => {
    setEditingNoteId(noteId);
    setEditedNoteText(currentText);
  };

  const handleSaveEditedNote = async (noteId: number) => {
    if (!editedNoteText.trim()) return toast.error("Note cannot be empty");
    try {
      await apiPut(`/appointments/${form.id}/notes/${noteId}`, {
        nota: editedNoteText.trim(),
      });
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, nota: editedNoteText } : n
        )
      );
      setEditingNoteId(null);
      toast.success("Note updated ✅");
    } catch {
      toast.error("Error updating note");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await apiDelete(`/appointments/${form.id}/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted ✅");
    } catch {
      toast.error("Error deleting note");
    }
  };

  /* =========================================================
     SAVE / UPDATE APPOINTMENT
  ========================================================= */
  const handleSubmit = async () => {
    const { title, date_time, client_id } = form;
    if (!title.trim()) return toast.error("Title is required");
    if (!date_time) return toast.error("Date and Time required");
    if (!client_id) return toast.error("Please select a client");

    const payload = {
      title: form.title.trim(),
      address: form.address?.trim() || "",
      advisor: form.advisor?.trim() || "",
      date_time: form.date_time,
      status: form.status,
      note: form.note?.trim() || "",
      client_id: form.client_id,
    };

    try {
      if (form.id) {
        const updated = await apiPut(`/appointments/${form.id}`, payload);
        await fetchNotes(form.id);
        toast.success("Appointment updated ✅");
        onSave(updated);
      } else {
        const created = await apiPost("/appointments", payload);
        toast.success("Appointment created ✅");
        onSave(created);
      }
      handleCloseSmoothly();
    } catch (err) {
      console.error("❌ Error saving appointment:", err);
      toast.error("Error saving appointment");
    }
  };

  /* =========================================================
     DELETE APPOINTMENT
  ========================================================= */
  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await apiDelete(`/appointments/${form.id}`);
      toast.success("Appointment deleted");
      onSave();
      handleCloseSmoothly();
    } catch {
      toast.error("Error deleting appointment");
    }
  };

  /* =========================================================
     SMOOTH CLOSE ANIMATION
  ========================================================= */
  const [closing, setClosing] = useState(false);
  const handleCloseSmoothly = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
    }, 180);
  };

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        e.stopPropagation();
        handleCloseSmoothly();
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-[480px] p-6 relative transform transition-all duration-200 ${
          closing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <button
          onClick={handleCloseSmoothly}
          className="absolute top-3 right-3 text-gray-500 hover:text-black"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold">
          {isEdit ? "Edit Appointment" : "New Appointment"}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Fill in the appointment details
        </p>

        <div className="space-y-3">
          {/* Client */}
          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-medium">Client</label>
            {isEdit || fromClient ? (
              <Input
                value={search}
                disabled
                className="mt-1 bg-gray-100 cursor-not-allowed"
              />
            ) : (
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search client..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  className="pl-8"
                />
                {dropdownOpen && search && (
                  <div className="absolute z-50 bg-white border rounded-lg shadow-md mt-1 max-h-40 overflow-y-auto w-full">
                    {filtered.length > 0 ? (
                      filtered.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleClientSelect(c)}
                          className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                          {c.fullname}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">
                        No clients found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Appointment title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-sm font-medium">Address</label>
            <Input
              placeholder="Client address or meeting location"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* Advisor */}
          <div>
            <label className="text-sm font-medium">Advisor (optional)</label>
            <Input
              placeholder="Advisor name"
              value={form.advisor}
              onChange={(e) => setForm({ ...form, advisor: e.target.value })}
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium">Date and Time</label>
            <Input
              type="datetime-local"
              value={form.date_time}
              onChange={(e) => setForm({ ...form, date_time: e.target.value })}
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              className="w-full border rounded-md p-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="visited">Visited</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          {/* Notes */}
          {form.id && (
            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Appointment Notes
              </h4>

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button size="sm" onClick={handleAddNote}>
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notes.length > 0 ? (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 bg-gray-50 rounded-md text-sm flex justify-between items-start"
                    >
                      <div className="flex-1 mr-2">
                        {editingNoteId === n.id ? (
                          <Textarea
                            className="text-sm w-full"
                            value={editedNoteText}
                            onChange={(e) => setEditedNoteText(e.target.value)}
                          />
                        ) : (
                          <>
                            <p>{n.nota}</p>
                            <div className="text-xs text-gray-500">
                              {n.author_name || "System"} •{" "}
                              {new Date(n.fecha).toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {editingNoteId === n.id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSaveEditedNote(n.id)}
                          >
                            <Save className="w-4 h-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditNote(n.id, n.nota)}
                          >
                            <Edit3 className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNote(n.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No notes yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-6">
          {isEdit && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={handleCloseSmoothly}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="px-6">
              {isEdit ? "Update Appointment" : "Save Appointment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
