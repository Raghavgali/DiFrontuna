import type { Call } from "../types/call";

export default function CallCard({ call }: { call: Call }) {
  return <div>{call.id}</div>;
}
