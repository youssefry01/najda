package com.najda.backend.incident.dto;

import com.najda.backend.incident.model.IncidentCategory;
import com.najda.backend.incident.model.LocationSource;

public record SubmitIncidentRequest(
        IncidentCategory category,
        String textMessage,
        Double latitude,
        Double longitude,
        LocationSource locationSource,
        Integer injuredCount,
        Boolean shareMedicalProfile,
        Double deviceLatitude,
        Double deviceLongitude,
        /** Optional. Random id (8-64 chars: letters, digits, - or _) making a retry of this report idempotent. */
        String clientRequestId
) {}