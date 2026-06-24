import client from "./client";

/**
 * Uploads a file to the server and returns its public URL.
 * That URL is then sent via WebSocket as the mediaUrl of the message.
 */
export async function uploadMedia(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await client.post("/api/v1/media/upload", formData, {
        headers: { "Content-Type": undefined }, // let browser set multipart/form-data + boundary
    });
    return response.data.data; // e.g. "http://localhost:8080/media/abc123.jpg"
}

/**
 * Looks at the browser's file.type and returns the correct MessageType
 * to send to the backend.
 *
 * Examples:
 *   "image/jpeg" -> "IMAGE"
 *   "video/mp4"  -> "VIDEO"
 *   "audio/mpeg" -> "AUDIO"
 *   "application/pdf" -> "FILE"
 */
export function getMessageType(file) {
    if (file.type.startsWith("image/")) return "IMAGE";
    if (file.type.startsWith("video/")) return "VIDEO";
    if (file.type.startsWith("audio/")) return "AUDIO";
    return "FILE"; // PDFs, Word docs, ZIPs, etc.
}