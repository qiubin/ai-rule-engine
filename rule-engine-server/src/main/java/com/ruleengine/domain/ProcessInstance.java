package com.ruleengine.domain;

import com.ruleengine.domain.enums.ProcessInstanceStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "process_instance")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_def_id", nullable = false)
    private Long processDefId;

    @Column(name = "process_code", nullable = false, length = 64)
    private String processCode;

    @Column(name = "business_key", length = 128)
    private String businessKey; // 业务标识，如 patientId + visitId

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private ProcessInstanceStatus status = ProcessInstanceStatus.RUNNING;

    @Lob
    @Column(name = "variables", columnDefinition = "CLOB")
    private String variables; // JSON: 流程变量

    @Column(name = "current_node_ids", length = 512)
    private String currentNodeIds; // 逗号分隔的当前节点ID

    @Lob
    @Column(name = "execution_log", columnDefinition = "CLOB")
    private String executionLog; // JSON: 执行历史记录

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "end_time")
    private LocalDateTime endTime;
}
