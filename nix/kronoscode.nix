{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node-modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "kronoscode";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.KRONOSCODE_DISABLE_MODELS_FETCH = true;
  env.KRONOSCODE_VERSION = finalAttrs.version;
  env.KRONOSCODE_CHANNEL = "local";

  buildPhase = ''
    runHook preBuild

    cd ./packages/kronoscode
    bun --bun ./script/build.ts --single --skip-install
    bun --bun ./script/schema.ts schema.json

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/kronoscode-*/bin/kronoscode $out/bin/kronoscode
    install -Dm644 schema.json $out/share/kronoscode/schema.json

    wrapProgram $out/bin/kronoscode \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if dunning on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      }

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # trick yargs into also generating zsh completions
    installShellCompletion --cmd kronoscode \
      --bash <($out/bin/kronoscode completion) \
      --zsh <(SHELL=/bin/zsh $out/bin/kronoscode completion)
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "KRONOSCODE_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    jsonschema = "${placeholder "out"}/share/kronoscode/schema.json";
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://kronoscode.ai/";
    license = lib.licenses.mit;
    mainProgram = "kronoscode";
    inherit (node_modules.meta) platforms;
  };
})
