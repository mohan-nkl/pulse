import client from "./client";

export const logCall = async ({ calleeId, mediaType, status, durationSec }) => {
    const res = await client.post("/api/calls/log", {
        calleeId,
        mediaType,
        status,
        durationSec,
    });
    return res.data.data;
};

export const getCallLogs = async () => {
    const res = await client.get("/api/calls");
    return res.data.data;
};