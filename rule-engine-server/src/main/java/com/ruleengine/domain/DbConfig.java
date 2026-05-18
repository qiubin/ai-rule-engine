package com.ruleengine.domain;

import lombok.Data;

@Data
public class DbConfig {

    private String host;
    private Integer port;
    private String databaseName;
    private String username;
    private String password;
    private Boolean useSsl = false;
}
