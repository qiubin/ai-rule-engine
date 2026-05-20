package com.ruleengine.domain;

import com.ruleengine.domain.enums.PathwayTaskType;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "pathway_task")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PathwayTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stage_id", nullable = false)
    private Long stageId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "task_type", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private PathwayTaskType taskType;

    @Column(name = "process_node_id", length = 64)
    private String processNodeId;

    @Column(name = "config", columnDefinition = "LONGTEXT")
    private String config;

    @Column(name = "required", nullable = false)
    private Boolean required = true;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
