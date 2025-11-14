# debug_run_task.py
from tasks.question_tasks import generate_questions_ai
# call the task's run method synchronously
res = generate_questions_ai.run("aca11eb9-62a9-447d-9a5e-2f69044c1b5d", 3)
print("TASK RUN RESULT:", res)
