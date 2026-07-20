export default function TypingIndicator() {
  return (
    <div className="flex justify-start enter">
      <div className="bubble bubble-agent flex items-center gap-1.5 py-3" aria-label="O consultor está a escrever">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
