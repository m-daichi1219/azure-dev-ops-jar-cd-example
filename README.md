# Java アプリケーション Azure DevOps CI/CD サンプル

## 1. 概要

このプロジェクトは、Azure DevOps を使用して Java (Spring Boot) アプリケーションの継続的インテグレーション (CI) と継続的デプロイ (CD) を実現するためのサンプルリポジトリです。

主な機能:

- `release/*` ブランチへのプッシュを手動トリガーとしてパイプラインを実行
- Maven を使用して Java アプリケーションをビルド・テスト
- ビルド成果物 (JAR ファイル) を AWS S3 バケットにバージョン管理してアップロード
- AWS EC2 インスタンスに SSH 経由でアプリケーションをインプレースデプロイ
- AWS CDK (手動実行) を使用して、デプロイ先の AWS リソース (S3 バケット、EC2 インスタンス) を管理

## 2. プロジェクト構成

```
.
├── cdk/                     # AWS リソース定義 (CDK)
│   ├── bin/
│   │   └── cdk.json
│   ├── lib/cdk-stack.ts     # S3, EC2 リソース定義 (要編集)
│   └── ...
├── docs/                    # ドキュメント
│   ├── 概要.md              # プロジェクト概要・要件定義
│   ├── 設計.md              # CI/CD パイプライン設計書
│   └── AzureDevOps設定手順.md # パイプライン実行のための Azure DevOps 設定
├── src/
│   ├── main/
│   │   ├── java/com/example/jarcddemo/ # Java ソースコード
│   │   │   ├── JarCdDemoApplication.java
│   │   │   └── HelloController.java
│   │   └── resources/
│   │       └── application.properties    # Spring Boot 設定
│   └── test/                     # テストコード (現在は空)
├── .gitignore               # Git 無視リスト
├── azure-pipelines.yml      # Azure Pipelines 定義 (要編集)
└── pom.xml                  # Maven プロジェクト定義
```

## 3. 前提条件

- Azure DevOps アカウントとプロジェクト
- AWS アカウント
- Node.js と npm (AWS CDK 実行用)
- AWS CLI (設定済み、CDK 実行用)
- Java JDK 17 (または `pom.xml` および `azure-pipelines.yml` で指定したバージョン)
- Maven

## 4. セットアップ手順

### 4.1. AWS リソースのプロビジョニング (CDK)

**注意:** この手順は手動で実行します。

1.  **CDK コードの編集:**
    - `cdk/lib/cdk-stack.ts` を開き、`TODO` コメントに従って以下のプレースホルダーを実際の値に置き換えます:
      - `allowedSshIp`: ★★★ SSH (ポート 22) 接続を許可する **あなたの IP アドレス** を CIDR 形式で指定します (例: `123.45.67.89/32`)。セキュリティのため `0.0.0.0/0` は絶対に使用しないでください。
    - 必要に応じて、EC2 インスタンスタイプ (`instanceType`) やキーペア名 (`name` プロパティ) も変更します。
2.  **CDK 依存関係のインストール:**
    ```bash
    cd cdk
    npm install
    npm install cdk-ec2-key-pair
    cd ..
    ```
3.  **CDK ブートストラップ (初回のみ):** AWS アカウント/リージョンで初めて CDK を使用する場合、または環境を変更した場合に実行します。
    ```bash
    cd cdk
    # npx cdk bootstrap aws://<ACCOUNT_ID>/<AWS_REGION>
    npx cdk bootstrap
    cd ..
    ```
4.  **CDK デプロイ:** AWS リソース (S3 バケット、EC2 インスタンス) を作成します。
    ```bash
    cd cdk
    npx cdk deploy
    cd ..
    ```
    - デプロイ後、出力される以下の値をメモしておきます:
      - `CdkStack.ArtifactBucketName`: S3 バケット名
      - `CdkStack.KeyPairSecretArn`: 作成された EC2 キーペアの秘密鍵が保存されている Secrets Manager のシークレット名 (または ARN パターン)。通常 `ec2-ssh-key/<キーペア名>/private` の形式です。

### 4.2. Azure DevOps の設定

`docs/AzureDevOps設定手順.md` に従い、以下の設定を行います。

1.  **AWS Service Connection の作成:** S3 へのアップロード、および Secrets Manager から秘密鍵を取得するために使用します。
2.  **SSH Service Connection の作成:** EC2 へのデプロイに使用します。
    - **秘密鍵の取得:** 手順 4.1 でメモした **Secrets Manager のシークレット名** を使用して、AWS マネジメントコンソールまたは AWS CLI で秘密鍵の値を取得し、Service Connection 設定に貼り付けます。
3.  **パイプライン変数の設定:** `azure-pipelines.yml` を直接編集するか、パイプライン設定 UI から以下の変数を設定します。
    - `s3BucketName`: 手順 4.1 でメモした **実際の S3 バケット名**
    - `awsServiceConnection`: 作成した AWS Service Connection の名前
    - `sshServiceConnection`: 作成した SSH Service Connection の名前
    - `deployTargetDirectory`: EC2 上のデプロイ先ディレクトリ (例: `/home/ec2-user/app`)
    - `appStopCommand`: EC2 上でアプリを停止するコマンド
    - `appStartCommand`: EC2 上でアプリを起動するコマンド
    - `jarFileNamePattern`: `jar-cd-demo-*.jar` (通常はこのままで OK)

### 4.3. EC2 インスタンスの準備

CDK で作成された EC2 インスタンスに必要な設定を行います。

1.  **SSH アクセスの確認:** 手順 4.2 で設定した SSH Service Connection が接続できること、または AWS Secrets Manager から取得した秘密鍵を使用してローカルから接続できることを確認します。CDK で設定した `allowedSshIp` からのみ接続可能です。
2.  **AWS CLI のインストールと設定:** インスタンスに AWS CLI がインストールされていることを確認します。CDK によって S3 バケットからの読み取り権限を持つ IAM ロールがインスタンスに自動的にアタッチされています。
3.  **Java ランタイムのインストール:** `pom.xml` で指定したバージョンの Java をインストールします。
4.  **アプリケーションディレクトリの作成/権限設定:** `azure-pipelines.yml` の `deployTargetDirectory` で指定したディレクトリを作成し、SSH 接続ユーザーが書き込めるように権限を設定します。
5.  **アプリケーションのサービス化 (推奨):** `appStopCommand` / `appStartCommand` で `systemd` サービスなどを利用する場合は、事前にサービス設定ファイルを作成しておきます。

## 5. パイプラインの実行

1.  コード変更をリポジトリにプッシュします。
2.  `release/*` 形式のブランチを作成します (例: `git checkout -b release/1.0.0`)
3.  このブランチをリモートリポジトリにプッシュします。
4.  Azure DevOps の [Pipelines] で対象パイプラインを選択し、[Run pipeline] をクリックします。
5.  実行する `release/*` ブランチを選択し、[Run] をクリックします。

パイプラインが実行され、ビルド、S3 へのアップロード、EC2 へのデプロイが行われます。

## 6. アプリケーションの確認

デプロイが成功したら、EC2 インスタンスのパブリック IP アドレスまたは DNS 名を使用してアプリケーションにアクセスします。

```bash
curl http://<EC2_PUBLIC_IP>:8080/hello
```

"Hello from Azure DevOps CI/CD!" と表示されれば成功です。

If you want to learn more about creating good readme files then refer the following [guidelines](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-a-readme?view=azure-devops). You can also seek inspiration from the below readme files:

- [ASP.NET Core](https://github.com/aspnet/Home)
- [Visual Studio Code](https://github.com/Microsoft/vscode)
- [Chakra Core](https://github.com/Microsoft/ChakraCore)
