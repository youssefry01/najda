package com.najda.backend.auth.dto;

import com.najda.backend.user.model.Gender;
import com.najda.backend.validation.EgyptianMobile;

public record RegisterCitizenRequest(
        String firstName,
        String lastName,
        String email,
        @EgyptianMobile String phone,
        String address,
        Gender gender
) {
}