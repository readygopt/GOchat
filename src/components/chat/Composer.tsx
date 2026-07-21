"use client";

import { useRef, useState, type KeyboardEvent } from "react";

export default function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function grow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer flex items-end gap-2 px-4 py-2.5 sm:gap-2.5 sm:px-4 sm:py-3">
      <textarea
        ref={ref}
        className="field max-h-40 py-2.5 text-[16px] leading-relaxed sm:py-1.5 sm:text-[15px]"
        rows={1}
        placeholder="Escreva a sua mensagem"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          grow();
        }}
        onKeyDown={onKeyDown}
        aria-label="Mensagem"
      />
      <button
        className="send-btn flex h-11 w-11 shrink-0 items-center justify-center sm:h-10 sm:w-10"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Enviar mensagem"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 11l5-5 5 5M12 6v13" />
        </svg>
      </button>
    </div>
  );
}
