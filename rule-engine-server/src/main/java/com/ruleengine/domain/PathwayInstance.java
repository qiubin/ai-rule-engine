package com.ruleengine.domain;

import com.ruleengine.domain.enums.PathwayInstanceStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "pathway_instance")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PathwayInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pathway_id", nullable = false)
    private Long pathwayId;

    @Column(name = "patient_id", nullable = false, length = 64)
    private String patientId;

    @Column(name = "visit_id", length = 64)
    private String visitId;

    @Column(name = "business_key", length = 128)
    private String businessKey;

    @Column(name = "status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private PathwayInstanceStatus status = PathwayInstanceStatus.ADMISSION_PENDING;

    @Column(name = "current_stage_id")
    private Long currentStageId;

    @Column(name = "current_stage_entry_time")
    private LocalDateTime currentStageEntryTime;

    @Column(name = "variables", columnDefinition = "LONGTEXT")
    private String variables;

    @Column(name = "execution_log", columnDefinition = "LONGTEXT")
    private String executionLog;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "end_time")
    private LocalDateTime endTime;
}
