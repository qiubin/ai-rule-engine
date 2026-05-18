package com.ruleengine.service;

import com.ruleengine.domain.DbConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class DbConfigService {

    private static final String CONFIG_DIR = "config";
    private static final String CONFIG_FILE = "db.properties";

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Value("${spring.datasource.username}")
    private String datasourceUsername;

    @Value("${spring.datasource.password}")
    private String datasourcePassword;

    private Path getConfigPath() {
        Path path = Paths.get(CONFIG_DIR, CONFIG_FILE);
        if (!path.isAbsolute()) {
            path = Paths.get(System.getProperty("user.dir"), CONFIG_DIR, CONFIG_FILE);
        }
        return path;
    }

    public DbConfig findFirst() {
        Path path = getConfigPath();
        if (!Files.exists(path)) {
            log.info("数据库配置文件不存在，使用 application.yml 配置");
            return createFromApplicationYaml();
        }
        Properties props = new Properties();
        try (InputStream is = new FileInputStream(path.toFile())) {
            props.load(is);
        } catch (IOException e) {
            log.warn("读取数据库配置失败: {}", e.getMessage());
            return createFromApplicationYaml();
        }
        return fromProperties(props);
    }

    public DbConfig save(DbConfig config) {
        Path path = getConfigPath();
        try {
            Files.createDirectories(path.getParent());
            Properties props = toProperties(config);
            try (OutputStream os = new FileOutputStream(path.toFile())) {
                props.store(os, "Rule Engine Database Configuration");
            }
            log.info("数据库配置已保存到: {}", path);
        } catch (IOException e) {
            log.error("保存数据库配置失败: {}", e.getMessage());
            throw new RuntimeException("保存配置失败: " + e.getMessage());
        }
        return config;
    }

    public DbConfig createFromApplicationYaml() {
        DbConfig cfg = parseJdbcUrl(datasourceUrl);
        cfg.setUsername(datasourceUsername);
        cfg.setPassword(datasourcePassword);
        return cfg;
    }

    private DbConfig parseJdbcUrl(String url) {
        DbConfig cfg = new DbConfig();
        if (url == null || url.isEmpty()) {
            throw new RuntimeException("spring.datasource.url 未配置");
        }
        // jdbc:mysql://host:port/db?params
        Pattern pattern = Pattern.compile("jdbc:mysql://([^:/]+)(?::(\\d+))?/([^?]+)");
        Matcher matcher = pattern.matcher(url);
        if (matcher.find()) {
            cfg.setHost(matcher.group(1));
            String portStr = matcher.group(2);
            cfg.setPort(portStr != null ? Integer.parseInt(portStr) : 3306);
            cfg.setDatabaseName(matcher.group(3));
        } else {
            throw new RuntimeException("无法解析 JDBC URL: " + url);
        }
        cfg.setUseSsl(url.contains("useSSL=true"));
        return cfg;
    }

    public boolean testConnection(DbConfig config) {
        String url = String.format(
            "jdbc:mysql://%s:%d/%s?useSSL=%s&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&characterEncoding=utf8",
            config.getHost(),
            config.getPort(),
            config.getDatabaseName(),
            config.getUseSsl()
        );
        try (Connection conn = DriverManager.getConnection(url, config.getUsername(), config.getPassword())) {
            return conn.isValid(5);
        } catch (Exception e) {
            log.warn("数据库连接测试失败: {}", e.getMessage());
            return false;
        }
    }

    private Properties toProperties(DbConfig config) {
        Properties props = new Properties();
        props.setProperty("db.host", config.getHost());
        props.setProperty("db.port", String.valueOf(config.getPort()));
        props.setProperty("db.databaseName", config.getDatabaseName());
        props.setProperty("db.username", config.getUsername());
        props.setProperty("db.password", config.getPassword());
        props.setProperty("db.useSsl", String.valueOf(config.getUseSsl()));
        return props;
    }

    private DbConfig fromProperties(Properties props) {
        DbConfig cfg = new DbConfig();
        cfg.setHost(props.getProperty("db.host"));
        String portStr = props.getProperty("db.port");
        cfg.setPort(portStr != null ? Integer.parseInt(portStr) : null);
        cfg.setDatabaseName(props.getProperty("db.databaseName"));
        cfg.setUsername(props.getProperty("db.username"));
        cfg.setPassword(props.getProperty("db.password"));
        cfg.setUseSsl(Boolean.parseBoolean(props.getProperty("db.useSsl", "false")));
        return cfg;
    }
}
