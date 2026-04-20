import TeacherForm from "../components/TeacherForm";
import SubjectForm from "../components/SubjectForm";
import SectionForm from "../components/SectionForm";

export default function SetupPage() {
  return (
    <div>
      <h1>Setup Data</h1>

      <TeacherForm />
      <SectionForm />
      <SubjectForm />
    </div>
  );
}