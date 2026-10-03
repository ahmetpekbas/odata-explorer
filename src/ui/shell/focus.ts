// Focus hand-offs around dialogs. A closing Fluent dialog keeps focus on its surface until its exit
// animation ends, then drops it to the page body; moving the focus any earlier loses to that.

/** Runs `fn` once no dialog is on the page (or after about a second). Returns a function that cancels. */
export function whenDialogsClosed(fn: () => void): () => void {
  let frame = 0;
  let frames = 0;
  const tick = () => {
    if (document.querySelector('[role="dialog"]') && ++frames < 60) {
      frame = requestAnimationFrame(tick);
    } else {
      fn();
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** Whether nothing has the focus: it is on the page body, as after the element holding it disappeared. */
export function focusIsLost(): boolean {
  return !document.activeElement || document.activeElement === document.body;
}

/** Moves the focus to the active tab of the workspace, once the dialog that is closing is gone. */
export function focusActiveTab(): void {
  whenDialogsClosed(() => {
    document.querySelector<HTMLElement>('main [role="tab"][aria-selected="true"]')?.focus();
  });
}
