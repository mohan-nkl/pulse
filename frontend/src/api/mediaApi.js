import client from "./client";

export async function uploadMedia(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await client.post("/api/v1/media/upload", formData, {
        headers: { "Content-Type": undefined },
    });
    return response.data.data;
}

export function getMessageType(file) {
    if (file.type.startsWith("image/")) return "IMAGE";
    if (file.type.startsWith("video/")) return "VIDEO";
    if (file.type.startsWith("audio/")) return "AUDIO";
    return "FILE";
}
