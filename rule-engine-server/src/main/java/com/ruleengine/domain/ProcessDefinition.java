package com.ruleengine.domain;

import com.ruleengine.domain.enums.ProcessStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "process_definition")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", unique = true, nullable = false, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description", length = 512)
    private String description;

    @Column(name = "version", length = 16)
    private String version = "1.0.0";

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private ProcessStatus status = ProcessStatus.DRAFT;

    @Lob
    @Column(name = "canvas_data", columnDefinition = "CLOB")
    private String canvasData; // JSON: ReactFlow nodes + edges

    @Lob
    @Column(name = "node_configs", columnDefinition = "CLOB")
    private String nodeConfigs; // JSON: 节点额外配置

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
