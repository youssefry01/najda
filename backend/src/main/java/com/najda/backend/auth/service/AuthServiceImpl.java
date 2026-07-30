package com.najda.backend.auth.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.najda.backend.auth.dto.EmployeeRegistrationResponse;
import com.najda.backend.auth.dto.RegisterCitizenRequest;
import com.najda.backend.auth.dto.RegisterEmployeeRequest;
import com.najda.backend.exceptions.ResourceNotFoundException;
import com.najda.backend.user.mapper.UserMapper;
import com.najda.backend.user.model.Role;
import com.najda.backend.user.model.User;
import com.najda.backend.user.repository.RoleRepository;
import com.najda.backend.user.repository.UserRepository;
import com.najda.backend.user.service.FirebaseClaimsService;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final FirebaseClaimsService firebaseClaimsService;
    private final UserMapper userMapper;


    public AuthServiceImpl(UserRepository userRepository, RoleRepository roleRepository, FirebaseClaimsService firebaseClaimsService, UserMapper userMapper) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.firebaseClaimsService = firebaseClaimsService;
        this.userMapper = userMapper;
    }

    @Override
    public ResponseEntity<?> registerCitizen(String firebaseUid, String provider, RegisterCitizenRequest request) {
        if (userRepository.findByFirebaseUid(firebaseUid).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "This account is already registered"));
        }

        Role citizenRole = roleRepository.findByRoleNameIgnoreCase("CITIZEN")
                .orElseThrow(() -> new ResourceNotFoundException("CITIZEN role not found -- has the roles table been seeded?"));

        User user = new User();
        user.setFirebaseUid(firebaseUid);
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setEmail(request.email());
        user.setPhone(request.phone());    // untrusted, unverified -- see phoneVerified below
        user.setPhoneVerified(false);
        user.setAddress(request.address());
        user.setGender(request.gender());
        user.setRole(citizenRole);
        recomputeProfileCompleted(user);

        userRepository.save(user);
        firebaseClaimsService.syncRoleClaim(firebaseUid, "CITIZEN");

        return ResponseEntity.status(201).body(userMapper.toResponse(user));
    }



    @Override
    public ResponseEntity<?> registerEmployee(RegisterEmployeeRequest request) {
        // Caller must already be ADMIN or SUPER_ADMIN --
        // enforced at the controller via @PreAuthorize.

        Role role = roleRepository.findByRoleNameIgnoreCase(request.roleName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Role not found: " + request.roleName()));

        // Same restriction as role updates: only a SUPER_ADMIN can create
        // another SUPER_ADMIN account.
        if (role.getRoleName().equalsIgnoreCase("SUPER_ADMIN")) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            User caller = (User) auth.getPrincipal();
            boolean callerIsSuperAdmin = caller.getRole() != null
                    && caller.getRole().getRoleName().equalsIgnoreCase("SUPER_ADMIN");
            if (!callerIsSuperAdmin) {
                throw new AccessDeniedException("Only a SUPER_ADMIN can create another SUPER_ADMIN account");
            }
        }

        // Temporary password: the employee never actually uses this --
        // generatePasswordResetLink below sends them straight to setting
        // their own password. It only exists because Firebase's createUser
        // requires *some* password to be set.
        String temporaryPassword = UUID.randomUUID().toString();

        UserRecord.CreateRequest createRequest = new UserRecord.CreateRequest()
                .setEmail(request.email())
                .setPassword(temporaryPassword)
                .setDisplayName(request.firstName() + " " + request.lastName());

        UserRecord firebaseUser;
        try {
            firebaseUser = FirebaseAuth.getInstance().createUser(createRequest);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of(
                    "error", "Could not create Firebase account: " + e.getMessage()));
        }

        try {
            User user = new User();
            user.setFirebaseUid(firebaseUser.getUid());
            user.setFirstName(request.firstName());
            user.setLastName(request.lastName());
            user.setEmail(request.email());
            user.setPhone(request.phone());
            user.setAddress(request.address());
            user.setGender(request.gender());
            user.setRole(role);

            userRepository.save(user);
            firebaseClaimsService.syncRoleClaim(firebaseUser.getUid(), role.getRoleName());

            String resetLink = FirebaseAuth.getInstance().generatePasswordResetLink(request.email());

            return ResponseEntity.status(201)
                    .body(new EmployeeRegistrationResponse(userMapper.toResponse(user), resetLink));

        } catch (Exception e) {
            // Roll back the Firebase account so we don't leave an orphaned
            // credential with no matching User row.
            try {
                FirebaseAuth.getInstance().deleteUser(firebaseUser.getUid());
            } catch (Exception cleanupFailure) {
                // Log this in a real setup -- an orphaned Firebase account
                // now exists and needs manual cleanup via the console.
            }
            throw new RuntimeException(e);
        }
    }

    private void recomputeProfileCompleted(User user) {
        // Presence-only -- verification status is tracked separately and
        // doesn't gate this. A citizen with an unverified phone can still use
        // the app; they just see the unverified badge until they confirm it.
        user.setProfileCompleted(
            user.getAddress() != null && !user.getAddress().isBlank()
            && user.getGender() != null
            && user.getPhone() != null && !user.getPhone().isBlank()
        );
    }
}