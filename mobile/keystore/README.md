# Android 签名密钥

## 文件说明

- `saolei.keystore` - 签名密钥文件（不提交到 git）
- `keystore.properties` - 签名配置（不提交到 git）

## 生成密钥

如果密钥丢失，可以使用以下命令重新生成：

```bash
keytool -genkey -v -keystore mobile/keystore/saolei.keystore \
  -alias saolei -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Saolei, OU=Game, O=Saolei, L=Unknown, ST=Unknown, C=CN"
```

## 注意事项

- 请妥善保管密码
- 密钥文件不要提交到版本控制
- 发布新版本时必须使用相同的密钥签名
