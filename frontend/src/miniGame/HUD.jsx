const HUD = ({ populacao }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4">
      <h2 className="text-lg font-semibold mb-2">Tropas Disponíveis</h2>
      <div className="flex justify-between">
        <div className="flex gap-1 mb-4">
          <div className="pr-4">
            <p className="text-sm text-slate-400">Colonos</p>
            <p className="text-xl font-mono">{populacao.colonos}</p>
          </div>
          <div className="border-l border-slate-600 pl-4">
            <p className="text-sm text-slate-400">Marines</p>
            <p className="text-xl font-mono">{populacao.marines}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
