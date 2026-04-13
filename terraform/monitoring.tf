resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  dimensions = {
    InstanceId = aws_instance.api.id
  }
}

# RDS monitoring removed - database now runs as container on EC2
