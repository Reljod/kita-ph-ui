/**
 * Tests for the shared overlay components.
 *
 * Both are destructive-action surfaces: `ConfirmDialog` guards deletes, and
 * `Modal` hosts the forms behind them. The behaviour worth pinning is the
 * dismissal paths — backdrop, escape, close button — because a dialog that
 * cannot be dismissed traps the user, and one that dismisses too eagerly
 * loses their input.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

function renderConfirm(overrides: Record<string, unknown> = {}) {
    const props = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Delete this agent?',
        description: 'This cannot be undone.',
        ...overrides,
    };
    render(<ConfirmDialog {...props} />);
    return props;
}

describe('ConfirmDialog', () => {
    it('renders nothing when closed', () => {
        renderConfirm({ isOpen: false });
        expect(screen.queryByText('Delete this agent?')).not.toBeInTheDocument();
    });

    it('shows the question', () => {
        renderConfirm();
        expect(screen.getByText('Delete this agent?')).toBeInTheDocument();
    });

    it('shows the consequence', () => {
        renderConfirm();
        expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    });

    it('defaults the confirm action to Delete', () => {
        renderConfirm();
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('accepts a custom confirm label', () => {
        renderConfirm({ confirmText: 'Deregister' });
        expect(screen.getByRole('button', { name: /deregister/i })).toBeInTheDocument();
    });

    it('accepts a custom cancel label', () => {
        renderConfirm({ cancelText: 'Keep it' });
        expect(screen.getByRole('button', { name: /keep it/i })).toBeInTheDocument();
    });

    it('confirms when the confirm button is pressed', () => {
        const props = renderConfirm();
        fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
        expect(props.onConfirm).toHaveBeenCalledOnce();
    });

    it('closes when cancelled', () => {
        const props = renderConfirm();
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('cancelling does not confirm', () => {
        // The whole point of the dialog is that one button is safe.
        const props = renderConfirm();
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('closes when the backdrop is clicked', () => {
        const props = renderConfirm();
        fireEvent.click(document.querySelector('.absolute.inset-0')!);
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('disables the confirm button while the delete is in flight', () => {
        // Double-clicking through a slow delete would fire it twice.
        renderConfirm({ isLoading: true });
        expect(screen.getByRole('button', { name: /delet/i })).toBeDisabled();
    });
});

function renderModal(overrides: Record<string, unknown> = {}) {
    const props = {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Add knowledge',
        children: <p>form body</p>,
        ...overrides,
    };
    render(<Modal {...props} />);
    return props;
}

describe('Modal', () => {
    it('renders nothing when closed', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('form body')).not.toBeInTheDocument();
    });

    it('renders its children', () => {
        renderModal();
        expect(screen.getByText('form body')).toBeInTheDocument();
    });

    it('shows the title', () => {
        renderModal();
        expect(screen.getByText('Add knowledge')).toBeInTheDocument();
    });

    it('omits the header when there is no title', () => {
        renderModal({ title: undefined });
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('closes from the close button', () => {
        const props = renderModal();
        fireEvent.click(screen.getByRole('button'));
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('closes when the backdrop is clicked', () => {
        const props = renderModal();
        fireEvent.click(document.querySelector('.absolute.inset-0')!);
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('closes on escape', () => {
        const props = renderModal();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('ignores other keys', () => {
        // Typing in the form it hosts must not dismiss it.
        const props = renderModal();
        fireEvent.keyDown(document, { key: 'a' });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('does not listen for escape while closed', () => {
        const props = renderModal({ isOpen: false });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('locks the page behind it', () => {
        // Without this the page scrolls under the dialog on mobile.
        renderModal();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores scrolling when unmounted', () => {
        const { unmount } = render(
            <Modal isOpen onClose={vi.fn()}>
                <p>body</p>
            </Modal>
        );
        unmount();
        expect(document.body.style.overflow).toBe('unset');
    });

    it('renders into a portal rather than in place', () => {
        // It has to escape any transformed ancestor, or the fixed overlay
        // positions against that ancestor instead of the viewport.
        const { container } = render(
            <Modal isOpen onClose={vi.fn()}>
                <p>portal body</p>
            </Modal>
        );
        expect(container).toBeEmptyDOMElement();
        expect(screen.getByText('portal body')).toBeInTheDocument();
    });

    it('accepts a custom width', () => {
        renderModal({ maxWidth: 'max-w-3xl' });
        expect(document.querySelector('.max-w-3xl')).toBeInTheDocument();
    });
});
