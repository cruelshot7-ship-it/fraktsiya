import { createFileRoute } from "@tanstack/react-router";
import { MiniApp } from "@/components/app/mini-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MiniApp />;
}
