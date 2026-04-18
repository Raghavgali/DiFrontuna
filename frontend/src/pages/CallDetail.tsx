import { useParams } from "react-router-dom";

export default function CallDetail() {
  const { id } = useParams();
  return <div>Call {id}</div>;
}
