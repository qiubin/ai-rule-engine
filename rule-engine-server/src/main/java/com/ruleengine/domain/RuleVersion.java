package com.ruleengine.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rule_version")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_id", nullable = false)
    private Long ruleId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "canvas_data", columnDefinition = "LONGTEXT")
    private String canvasData;

    @Column(name = "drools_drl", columnDefinition = "LONGTEXT")
    private String droolsDrl;

    @Column(name = "change_note", length = 255)
    private String changeNote;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
