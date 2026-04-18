import type { TranscriptTurn } from "../types/call";

export default function TranscriptView({ turns }: { turns: TranscriptTurn[] }) {
  return (
    <ul>
      {turns.map((t, i) => (
        <li key={i}>
          <b>{t.speaker}:</b> {t.text}
        </li>
      ))}
    </ul>
  );
}
