import { useEffect, useRef } from 'react';
import { knowledgeService } from '@/services/knowledgeService';
import { useState } from 'react';

interface UsePreviewResult {
    objectUrl: string | null;
    isLoading: boolean;
    error: string | null;
}

export function usePreview(fileId: string): UsePreviewResult {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchPreview = async () => {
            try {
                const blob = await knowledgeService.getPreview(fileId);
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                objectUrlRef.current = url;
                setObjectUrl(url);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load file preview');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchPreview();

        return () => {
            cancelled = true;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [fileId]);

    return { objectUrl, isLoading, error };
}
