import { createServerFn } from "@tanstack/react-start";

export const getTomTomKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.TOMTOM_API_KEY ?? "" };
});
