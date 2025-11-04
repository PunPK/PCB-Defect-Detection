import PropTypes from "prop-types";

const Delete = ({
  isOpen,
  onClose,
  onDelete,
  itemName,
  confirmText = "Are you sure you want to delete this item?",
  cancelText = "Cancel",
  deleteText = "Delete",
}) => {
  const handleDelete = () => {
    console.log(typeof onDelete);
    onDelete();
    console.log(`${itemName} deleted successfully.`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">
                Delete {itemName}
              </h3>
              <p className="mt-2 text-sm text-gray-500">{confirmText}</p>
            </div>
          </div>

          <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
            <button
              onClick={handleDelete}
              className={`w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-sm`}
            >
              {deleteText}
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Delete.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  itemName: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  deleteText: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

export default Delete;
