type Props = {
  role: "user" | "assistant";
  content: string;
};

export default function Message({ role, content }: Props) {
  return (
    <div style={{ marginBottom: 10 }}>
      <b>{role}:</b> {content}
    </div>
  );
}
