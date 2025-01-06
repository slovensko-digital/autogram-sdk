
import { AvmSimpleChannel } from "./channel";
import { FullClient } from "./ui";

async function main() {
  const client = new FullClient(new AvmSimpleChannel(), () => {});
  const filePicker = document.createElement("input");
  filePicker.type = "file";
  filePicker.addEventListener("change", async (e) => {
    const file = filePicker.files?.[0];
    if (!file) return;

    const signedObject = await client.sign(
      {
        content: await file.text(),
        filename: file.name,
      },
      {
        level: "XAdES_BASELINE_B",
        container: "ASiC_E",
      },
      file.type,
      true
    );

    console.log(signedObject);

    const a = document.createElement("a");
    const blob = new Blob([signedObject.content], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${file.name}.asice`;
    a.text = `Download ${a.download}`;
    document.body.appendChild(a);
  });

  document.body.appendChild(filePicker);
}

main().then(
  () => console.log("done"),
  (err) => console.error(err)
);
