package com.ruleengine.repository;

import com.ruleengine.domain.Rule;
import com.ruleengine.domain.enums.RuleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RuleRepository extends JpaRepository<Rule, Long> {
    Optional<Rule> findByCode(String code);
    List<Rule> findByRuleTypeId(Long ruleTypeId);
    List<Rule> findByRuleTypeIdIn(List<Long> ruleTypeIds);
    long countByRuleTypeId(Long ruleTypeId);
    List<Rule> findByStatus(RuleStatus status);

    // 回收站查询
    List<Rule> findByDeletedTrue();

    // 排除已删除的规则
    List<Rule> findByDeletedFalse();
    List<Rule> findByDeletedFalseAndRuleTypeId(Long ruleTypeId);
    List<Rule> findByDeletedFalseAndRuleTypeIdIn(List<Long> ruleTypeIds);
    long countByDeletedFalseAndRuleTypeId(Long ruleTypeId);

    List<Rule> findByRuleTypeIdAndStatusAndDeletedFalse(Long ruleTypeId, RuleStatus status);
}
