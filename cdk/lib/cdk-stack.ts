import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KeyPair } from "cdk-ec2-key-pair";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === S3 バケット定義 ===
    const artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
      bucketName: `jar-cd-example-artifacts-${this.account}-${this.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // === EC2 キーペア作成 ===
    const key = new KeyPair(this, "Ec2KeyPair", {
      keyPairName: "jar-cd-ec2-key",
      description: "Key pair for jar-cd-example EC2 instance",
      storePublicKey: true,
    });

    // === EC2 インスタンス定義 ===
    const instanceType = "t2.micro";
    const allowedSshIp = "123.45.67.89/32"; //TODO: 接続元のIPを指定する

    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    const webServerSecurityGroup = new ec2.SecurityGroup(
      this,
      "WebServerSecurityGroup",
      {
        vpc,
        description: "Allow SSH access from specified IP",
        allowAllOutbound: true,
      }
    );
    webServerSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(allowedSshIp),
      ec2.Port.tcp(22),
      "Allow SSH access from specified IP"
    );

    const webServer = new ec2.Instance(this, "WebServerInstance", {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      keyName: key.keyPairName,
      securityGroup: webServerSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: new cdk.aws_iam.Role(this, "EC2S3ReadRole", {
        assumedBy: new cdk.aws_iam.ServicePrincipal("ec2.amazonaws.com"),
        description: "IAM role for EC2 to read from S3 artifact bucket",
      }),
    });
    artifactBucket.grantRead(webServer.role);

    new cdk.CfnOutput(this, "ArtifactBucketName", {
      value: artifactBucket.bucketName,
      description: "Name of the S3 bucket for build artifacts",
    });
    new cdk.CfnOutput(this, "WebServerInstanceId", {
      value: webServer.instanceId,
      description: "Instance ID of the EC2 web server",
    });
    new cdk.CfnOutput(this, "WebServerPublicIp", {
      value: webServer.instancePublicIp,
      description: "Public IP address of the EC2 web server",
    });
    new cdk.CfnOutput(this, "KeyPairName", {
      value: key.keyPairName,
      description: "Name of the EC2 key pair created",
    });
    new cdk.CfnOutput(this, "KeyPairSecretArn", {
      value: `arn:aws:secretsmanager:${this.region}:${this.account}:secret:ec2-ssh-key/${key.keyPairName}/private-*`,
      description:
        "ARN pattern of the secret containing the private key in Secrets Manager",
    });
  }
}
