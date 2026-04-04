import os
from pathlib import Path

import psycopg2 as sql
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

connection = sql.connect(
    host="localhost",
    dbname="postgres",
    user="postgres",
    password=os.environ.get("SQL_PSWRD"),
    port=os.environ.get("PORT"),
)

cursor = connection.cursor()

connection.commit()
cursor.close()
connection.close()
