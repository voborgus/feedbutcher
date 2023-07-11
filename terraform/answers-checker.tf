resource "yandex_function" "answers_checker" {
  name = "answers-checker"
  runtime = "nodejs12"
  entrypoint = "api/newAnswersChecker.eventHandler"
  memory = "512"
  description = "Check answers in all forms"
  execution_timeout = "300"
  environment = {
    "AWS_ACCESS_KEY_ID": var.s3_config.access_key,
    "AWS_SECRET_ACCESS_KEY": var.s3_config.secret_key,
    "BUCKET_ID": var.s3_config.bucket,
    "bot_token": var.bot_token,
    "cloud_id": var.yc_cloud_id,
    "dynamodb_table": var.dynamodb_table,
    "region": var.s3_config.region,
    "form_to_copy": var.form_to_copy,
    "stars_answer_id": var.stars_answer_id,
    "comments_answer_id": var.comments_answer_id,
    "folder_where_to_store": var.folder_where_to_store,
    "google_client_email": var.google_client_email,
    "support_chat_id": var.support_chat_id,
    "db_id": yandex_ydb_database_serverless.database1.id,
    "DEBUG": "*"
  }
  user_hash = filesha256(data.archive_file.code_archive.output_path)
  content {
    zip_filename = data.archive_file.code_archive.output_path
  }
}

output "yandex_function_answers_checker_id" {
  value = yandex_function.answers_checker.id
}