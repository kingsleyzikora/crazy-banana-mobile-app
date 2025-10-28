# MSK Security Group
resource "aws_security_group" "msk" {
  name        = "${var.project_name}-msk-sg"
  description = "Security group for MSK Kafka"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Kafka from EKS"
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  ingress {
    description     = "Zookeeper from EKS"
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  ingress {
    description = "Kafka within MSK"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-msk-sg"
    }
  )
}

# MSK Configuration
resource "aws_msk_configuration" "main" {
  name              = "${var.project_name}-msk-config"
  kafka_versions    = ["3.5.1"]
  server_properties = <<PROPERTIES
auto.create.topics.enable=true
default.replication.factor=2
min.insync.replicas=1
num.io.threads=8
num.network.threads=5
num.partitions=3
num.replica.fetchers=2
replica.lag.time.max.ms=30000
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
socket.send.buffer.bytes=102400
unclean.leader.election.enable=true
zookeeper.session.timeout.ms=18000
PROPERTIES
}

# MSK Cluster
resource "aws_msk_cluster" "main" {
  cluster_name           = "${var.project_name}-kafka"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = var.kafka_number_of_brokers

  broker_node_group_info {
    instance_type   = var.kafka_instance_type
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS_PLAINTEXT"
      in_cluster    = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-kafka"
    }
  )
}

# CloudWatch Log Group for MSK
resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.project_name}-kafka"
  retention_in_days = 7

  tags = var.tags
}
