package com.mohan.pulse.call;

import com.mohan.pulse.call.dtos.CallSignalRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class CallController {

    private final CallService callService;

    @MessageMapping("/call.signal")
    public void signal(CallSignalRequest request, Principal principal) {
        Long callerId = Long.valueOf(principal.getName());
        callService.handleSignal(callerId, request);
    }
}