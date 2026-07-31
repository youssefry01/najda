package com.najda.backend.security.configuration;

import java.util.List;
import com.najda.backend.security.filter.FirebaseTokenAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // required for @PreAuthorize to actually be enforced
public class SecurityConfig {

    private final FirebaseTokenAuthFilter firebaseTokenAuthFilter;

    public SecurityConfig(FirebaseTokenAuthFilter firebaseTokenAuthFilter) {
        this.firebaseTokenAuthFilter = firebaseTokenAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                // A brand-new citizen has no User row yet, so the normal
                // authenticated() check would reject them. This endpoint is
                // public at the Spring Security level; the controller itself
                // still requires a valid Firebase token (via the "firebaseUid"
                // request attribute set by FirebaseTokenAuthFilter) before
                // doing anything.
                .requestMatchers("/api/auth/register/citizen").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(firebaseTokenAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "https://najda-web.vercel.app"
        ));

        config.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
        ));

        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }
}