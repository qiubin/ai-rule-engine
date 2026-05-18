package com.ruleengine.domain;

import com.ruleengine.domain.enums.RuleStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "rule")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Rule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", unique = true, nullable = false, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "version", length = 16)
    private String version = "1.0.0";

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private RuleStatus status = RuleStatus.DRAFT;

    @Column(name = "remark", length = 512)
    private String remark; // 备注：实现方法关键词+对应计算符+配置要点

    @Column(name = "rule_type_id", nullable = false)
    private Long ruleTypeId;

    @Lob
    @Column(name = "canvas_data", columnDefinition = "CLOB")
    private String canvasData; // JSON: ReactFlow nodes + edges

    @Lob
    @Column(name = "drools_drl", columnDefinition = "CLOB")
    private String droolsDrl; // 生成的DRL规则文本

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
