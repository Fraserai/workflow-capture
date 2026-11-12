"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { API_BASE_URL } from "@/lib/api";

type NormalizeButtonProps = {
  sessionId: string;
};

export function NormalizeButton({ sessionId }: NormalizeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      className="primary-action inline"
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true);
        try {
          await fetch(`${API_BASE_URL}/tasks/normalize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              force: true,
            }),
          });
          router.refresh();
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? "Normalizing..." : "Run normalization"}
    </button>
  );
}
