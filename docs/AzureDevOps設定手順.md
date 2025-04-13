# Azure DevOps パイプライン設定手順

## 1. 概要

このドキュメントは、`azure-pipelines.yml` で定義された CI/CD パイプラインを実行するために Azure DevOps プロジェクトで必要な設定について説明します。

主に以下の設定が必要です:

- AWS への接続情報 (Service Connection)
- EC2 インスタンスへの SSH 接続情報 (Service Connection)
- パイプライン実行に必要な変数

## 2. Service Connections の設定

Azure DevOps プロジェクト設定から Service Connection を作成します。

[Project Settings] > [Pipelines] > [Service connections] に移動します。

### 2.1. AWS Service Connection

- **目的:** ビルド成果物を AWS S3 バケットにアップロードするため、および EC2 接続用の SSH 秘密鍵を AWS Secrets Manager から取得するために使用します。
- **作成手順:**
  1. [New service connection] をクリックします。
  2. [AWS] を選択し、[Next] をクリックします。
  3. 認証方法を選択します (推奨: Access Key または IAM Role assigned to a virtual machine)。
  4. 必要な認証情報 (アクセスキー ID, シークレットアクセスキー、または IAM ロール情報) を入力します。
  5. **Service connection name** に、`azure-pipelines.yml` の `variables.awsServiceConnection` で指定した名前 (例: `Your_AWS_Service_Connection_Name`) を入力します。
  6. [Verify and save] をクリックします。
- **注意点:** この Service Connection に紐づく AWS クレデンシャルには、以下の権限が必要です:
  - 対象 S3 バケット (`s3BucketName` で指定) への書き込み権限 (`s3:PutObject` など)
  - CDK が作成した Secrets Manager シークレット (`ec2-ssh-key/<キーペア名>/private`) からの値の読み取り権限 (`secretsmanager:GetSecretValue`)

### 2.2. SSH Service Connection

- **目的:** アプリケーションを AWS EC2 インスタンスにデプロイするために SSH 経由で接続する際に使用します。
- **作成手順:**
  1. [New service connection] をクリックします。
  2. リストから [SSH] を選択し、[Next] をクリックします。
  3. デプロイ対象 EC2 インスタンスの **Host Name** (または IP アドレス)、**Port** (通常 22)、**Username** (例: `ec2-user`) を入力します。
  4. **Private Key** に、**AWS Secrets Manager から取得した EC2 接続用の秘密鍵** の内容を貼り付けます。
     - **秘密鍵の取得方法:**
       1. CDK のデプロイ時に出力された `KeyPairSecretArn` (またはシークレット名 `ec2-ssh-key/<キーペア名>/private`) を確認します。
       2. AWS マネジメントコンソールの Secrets Manager に移動するか、AWS CLI (`aws secretsmanager get-secret-value --secret-id ec2-ssh-key/<キーペア名>/private --query SecretString --output text`) を使用して、シークレットの値 (秘密鍵) を取得します。
       3. 取得した秘密鍵の**全文** (`-----BEGIN RSA PRIVATE KEY-----` から `-----END RSA PRIVATE KEY-----` まで) をコピーします。
  5. **Service connection name** に、`azure-pipelines.yml` の `DeployToEC2` ステージの `variables.sshServiceConnection` で指定した名前 (例: `Your_EC2_SSH_Service_Connection_Name`) を入力します。
  6. [Verify and save] をクリックします。

## 3. パイプライン変数の設定

`azure-pipelines.yml` 内の `variables` セクションで定義されている変数を、実際の環境に合わせて設定する必要があります。これらの変数は YAML ファイル内で直接編集するか、Azure DevOps のパイプライン設定 UI から設定できます (UI での設定を推奨)。

[Pipelines] > [対象のパイプラインを選択] > [Edit] > [Variables] から変数を設定・上書きできます。

以下の変数が正しく設定されていることを確認してください:

- `awsServiceConnection`: (YAML 内で設定) 作成した AWS Service Connection の名前と一致していること。
- `awsRegion`: (YAML 内で設定) 対象の AWS リージョンが正しいこと。
- `s3BucketName`: **(重要)** 手動で `cdk deploy` して作成した S3 バケットの **実際の名前** を設定してください。
- `mavenPOMFile`: (YAML 内で設定) Maven プロジェクトの `pom.xml` のパスが正しいこと。
- `sshServiceConnection`: (`DeployToEC2` ステージ内で設定) 作成した SSH Service Connection の名前と一致していること。
- `deployTargetDirectory`: (`DeployToEC2` ステージ内で設定) EC2 インスタンス上のアプリケーションをデプロイする **実際のディレクトリパス** を設定してください。
- `jarFileNamePattern`: (`DeployToEC2` ステージ内で設定) ビルドされる JAR ファイルの命名規則に合わせた **正しいファイル名パターン** (例: `my-app-*.jar`) を設定してください (`BuildAndUpload` ステージの `CopyFiles` タスクや `AWSCLI@1` タスクのパターンと一致させる必要があります)。
- `appStopCommand`: (`DeployToEC2` ステージ内で設定) EC2 インスタンス上でアプリケーションを **停止するための正確なコマンド** を設定してください。
- `appStartCommand`: (`DeployToEC2` ステージ内で設定) EC2 インスタンス上でアプリケーションを **起動するための正確なコマンド** を設定してください。

## 4. パイプラインの実行

1. **前提条件:** `cdk deploy` コマンドを手動で実行し、必要な AWS リソース (S3 バケット、EC2 インスタンス) がプロビジョニングされていることを確認します。
2. Azure DevOps の [Pipelines] メニューから、設定したパイプラインを選択します。
3. [Run pipeline] ボタンをクリックします。
4. **Branch/tag** で、`release/*` 形式のブランチ (例: `release/1.0.0`) を選択します。
5. 必要に応じて [Variables] で実行時変数を上書きします。
6. [Run] ボタンをクリックしてパイプラインを開始します。
