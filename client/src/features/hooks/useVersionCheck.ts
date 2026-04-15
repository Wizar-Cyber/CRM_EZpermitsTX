import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type BuildInfo = {
  builtAt: string;
  commit?: string;
  node?: string;
};

/**
 * Hook que detecta cuando hay una nueva versión disponible
 * Revisa periodicamente el build-info.json para detectar cambios
 */
export function useVersionCheck() {
  const [currentBuildInfo, setCurrentBuildInfo] = useState<BuildInfo | null>(null);
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);

  useEffect(() => {
    // Cargar build info inicial
    const loadInitialBuildInfo = async () => {
      try {
        const response = await fetch('/build-info.json', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentBuildInfo(data);
          // Guardar en sessionStorage para comparar
          sessionStorage.setItem('original-build-info', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Error loading initial build info:', err);
      }
    };

    loadInitialBuildInfo();

    // Revisar nuevas versiones cada 5 minutos
    const intervalId = setInterval(async () => {
      setIsCheckingVersion(true);
      try {
        const response = await fetch('/build-info.json', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (response.ok) {
          const newBuildInfo = await response.json();
          const originalInfo = sessionStorage.getItem('original-build-info');
          
          if (originalInfo) {
            const original = JSON.parse(originalInfo);
            
            // Si el buildInfo cambió, hay una nueva versión
            if (original.builtAt !== newBuildInfo.builtAt) {
              console.log('Nueva versión disponible del CRM');
              
              // Mostrar notificación y permitir recargar
              toast.info(
                'Una nueva versión del CRM está disponible. Recarga la página para actualizar.',
                {
                  duration: 0, // No desaparece automáticamente
                  action: {
                    label: 'Recargar',
                    onClick: () => {
                      // Limpiar caché de service worker y recargar
                      if ('caches' in window) {
                        caches.keys().then(cacheNames => {
                          Promise.all(
                            cacheNames.map(cacheName => caches.delete(cacheName))
                          ).then(() => {
                            window.location.reload();
                          });
                        });
                      } else {
                        window.location.reload();
                      }
                    }
                  }
                }
              );
            }
          }
        }
      } catch (err) {
        console.warn('Error checking for new version:', err);
      } finally {
        setIsCheckingVersion(false);
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(intervalId);
  }, []);

  return { isCheckingVersion };
}
