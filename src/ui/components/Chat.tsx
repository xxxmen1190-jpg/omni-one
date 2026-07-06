import { useState } from "react";
import useChatStore from "../../store/useChatStore";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, addMessage } = useChatStore();

  const send = () => {
    if (!input.trim()) return;

    addMessage({ role: "user", content: input });

    // בסיס בלבד (שלב 1)
    addMessage({
      role: "assistant",
      content: "Omni One Starter פעיל ✅"
    });

    setInput("");
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: "80vh", overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.role}:</b> {m.content}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: "80%" }}
      />
      <button onClick={send}>שלח</button>
    </div>
  );
}
