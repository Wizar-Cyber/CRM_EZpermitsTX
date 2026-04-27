import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
type LeadQualityItem = {
  name: string;
  value: number;
  fill?: string;
};

interface LeadQualityCardsProps {
  data: LeadQualityItem[];
  onColorClick?: (color: string) => void;
}

const QUALITY_COLORS: Record<string, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  red: "#ef4444",
};

const QUALITY_LABELS: Record<string, string> = {
  green: "Green",
  blue: "Blue",
  yellow: "Yellow",
  red: "Red",
};

const MAIN_COLORS = ["green", "blue", "yellow", "red"];

export function LeadQualityCards({ data, onColorClick }: LeadQualityCardsProps) {
  const [, setLocation] = useLocation();

  const byName = Object.fromEntries(data.map((d) => [d.name, d]));

  const handleColorClick = (color: string) => {
    if (onColorClick) {
      onColorClick(color);
    } else {
      // Default behavior: navigate to leads page with color filter
      setLocation(`/leads?color=${color.toUpperCase()}`);
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {MAIN_COLORS.map((colorKey) => {
        const item = byName[colorKey];
        const count = item?.value ?? 0;
        const color = QUALITY_COLORS[colorKey];
        const label = QUALITY_LABELS[colorKey];

        return (
          <Card
            key={colorKey}
            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-2"
            style={{ borderColor: color + '40' }}
            onClick={() => handleColorClick(colorKey)}
          >
            <CardContent className="p-4 text-center">
              <div
                className="w-8 h-8 rounded-full mx-auto mb-2 border-2 border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
              <div className="text-2xl font-bold mb-1">{count}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
              <Badge
                variant="secondary"
                className="mt-2 text-xs"
                style={{
                  backgroundColor: color + '20',
                  color: color,
                  borderColor: color + '40'
                }}
              >
                Ver leads
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}