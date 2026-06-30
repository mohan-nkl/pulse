package com.mohan.pulse.call.dtos;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RecordCallRequest {

    private Long calleeId;
    private String mediaType;
    private String status;
    private Integer durationSec;  
}