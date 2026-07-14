import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const tempRoot = mkdtempSync(join(tmpdir(), "pi-zai-consumer-install-"));
const packDirectory = join(tempRoot, "pack");
const consumerDirectory = join(tempRoot, "consumer");
const hostPackage = "@earendil-works/pi-coding-agent";
const leakedPackages = [
	hostPackage,
	"@google/genai",
	"@mimo-ai/cli",
	"freebuff",
	"protobufjs",
	"ws",
];

function packagePath(root, packageName) {
	return join(root, "node_modules", ...packageName.split("/"));
}

try {
	mkdirSync(packDirectory, { recursive: true });
	mkdirSync(consumerDirectory, { recursive: true });

	const packOutput = execFileSync(
		npmCommand,
		["pack", "--json", "--pack-destination", packDirectory],
		{
			cwd: packageRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const [packResult] = JSON.parse(packOutput);
	assert.ok(packResult?.filename, "npm pack did not return a tarball filename");

	const tarballPath = join(packDirectory, packResult.filename);
	writeFileSync(
		join(consumerDirectory, "package.json"),
		`${JSON.stringify({ name: "pi-zai-consumer-check", private: true }, null, 2)}\n`,
	);

	execFileSync(
		npmCommand,
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
			tarballPath,
		],
		{
			cwd: consumerDirectory,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	const installedManifestPath = packagePath(
		consumerDirectory,
		"@onlinechefgroep/pi-zai/package.json",
	);
	assert.ok(existsSync(installedManifestPath), "packed extension was not installed");

	const installedManifest = JSON.parse(readFileSync(installedManifestPath, "utf8"));
	assert.equal(
		installedManifest.peerDependenciesMeta?.[hostPackage]?.optional,
		true,
		`${hostPackage} must remain an optional peer dependency`,
	);

	for (const packageName of leakedPackages) {
		assert.equal(
			existsSync(packagePath(consumerDirectory, packageName)),
			false,
			`standalone install unexpectedly provisioned ${packageName}`,
		);
	}

	console.log("Consumer install is isolated from the Pi host dependency tree.");
} finally {
	rmSync(tempRoot, { recursive: true, force: true });
}
