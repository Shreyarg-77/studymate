import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import Note from "../models/Note.js";
import StudySlot from "../models/StudySlot.js";
import PomodoroSession from "../models/PomodoroSession.js";
import UserSettings from "../models/UserSettings.js";

// Accounts created by the test scripts, for example test1700000000000@example.com
const TEST_EMAIL = /^(test|other|robust|missed|sec)\d+@example\.com$/;

const apply = process.argv.includes("--yes");
const emailArg = process.argv.find((a) => a.startsWith("--email="));
const singleEmail = emailArg
  ? emailArg.slice("--email=".length).toLowerCase().trim()
  : null;

const related = [
  ["subjects", Subject],
  ["tasks", Task],
  ["timetable entries", TimetableEntry],
  ["notes", Note],
  ["study slots", StudySlot],
  ["pomodoro sessions", PomodoroSession],
  ["settings", UserSettings],
];

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to database "${mongoose.connection.name}"`);

  const filter = singleEmail ? { email: singleEmail } : { email: TEST_EMAIL };
  const users = await User.find(filter).select("name email").lean();

  if (users.length === 0) {
    console.log("No matching accounts found.");
  } else {
    const ids = users.map((u) => u._id);
    console.log(`Found ${users.length} account(s):`);
    users.slice(0, 20).forEach((u) => console.log(`  ${u.name} <${u.email}>`));
    if (users.length > 20) console.log(`  ...and ${users.length - 20} more`);
    for (const [name, Model] of related) {
      const count = await Model.countDocuments({ user: { $in: ids } });
      console.log(`  ${name}: ${count}`);
    }

    if (!apply) {
      console.log(
        "\nDry run only. Nothing was deleted. Run again with --yes to delete.",
      );
    } else {
      for (const [name, Model] of related) {
        const result = await Model.deleteMany({ user: { $in: ids } });
        console.log(`Deleted ${result.deletedCount} ${name}`);
      }
      const result = await User.deleteMany({ _id: { $in: ids } });
      console.log(`Deleted ${result.deletedCount} account(s).`);
    }
  }
} catch (err) {
  console.error("Cleanup failed:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
