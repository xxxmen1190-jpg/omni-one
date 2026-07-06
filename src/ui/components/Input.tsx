type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
};

export default function Input({ value, onChange, onSend }: Props) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        style={{ width: "80%", padding: 10, borderRadius: 6, border: "none" }}
        placeholder="הקלד הודעה..."
      />
      <button onClick={onSend} style={{ padding: "10 20px", borderRadius: 6 }}>
        שלח
      </button>
    </div>
  );
}
