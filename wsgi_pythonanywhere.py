# Salin isi file ini ke file WSGI di tab "Web" PythonAnywhere.
# Ganti USERNAME dengan username PythonAnywhere Anda.
import os
import sys

USERNAME = "USERNAME"
project_home = f"/home/{USERNAME}/hackathongoks"
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(project_home, ".env"))

from app import app as application  # noqa: E402,F401
