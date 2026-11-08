import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, toastFailure } from "@/lib/apiClient";

export function useBoardSettings(boardId: string) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  /** Rejects on failure so the field can roll back and explain. */
  const updateField = async (fieldKey: string, value: string | number) => {
    await apiClient(`/boards/${boardId}`, { method: "PATCH", data: { [fieldKey]: value } });
    router.refresh();
  };

  // DELETE /boards/:id stashes the board (recoverable from the Stash page).
  const deleteBoard = async () => {
    setIsDeleting(true);
    try {
      await apiClient(`/boards/${boardId}`, { method: "DELETE" });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toastFailure(err, "ย้าย Project เข้า Stash ไม่สำเร็จ");
      setIsDeleting(false);
    }
  };

  return { updateField, deleteBoard, isDeleting };
}
