'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface Props {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
    return (
        <div className={cn('markdown-content text-[15px] max-w-none break-words', className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
